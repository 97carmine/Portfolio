FROM nginx:mainline-alpine as builder

ARG ENABLED_MODULES

RUN set -ex \
    && if [ "$ENABLED_MODULES" = "" ]; then \
        echo "No additional modules enabled, exiting"; \
        exit 1; \
    fi

COPY ./ /modules/

RUN set -ex \
    && apk update \
    && apk add --no-cache --virtual build-deps abuild autoconf automake byacc curl-dev flex g++ gcc geoip-dev \
        git libc-dev libmaxminddb-dev libstdc++ libtool libxml2-dev libxml2-utils libxslt linux-headers lmdb-dev make \
        mercurial musl-dev openssl openssl-dev pcre-dev unzip xz yajl-dev zlib-dev \
    # allow abuild as a root user \
    && printf "#!/bin/sh\\n/usr/bin/abuild -F \"\$@\"\\n" > /usr/local/bin/abuild \
    && chmod +x /usr/local/bin/abuild \
    && hg clone -r ${NGINX_VERSION}-${PKG_RELEASE} https://hg.nginx.org/pkg-oss/ /opt/pkg-oss \
    && cd /opt/pkg-oss \
    && mkdir /tmp/packages \
    && for module in $ENABLED_MODULES; do \
        echo "Building $module for nginx-$NGINX_VERSION"; \
        if [ -d /modules/$module ]; then \
            echo "Building $module from user-supplied sources"; \
            # check if module sources file is there and not empty
            if [ ! -s /modules/$module/source ]; then \
                echo "No source file for $module in modules/$module/source, exiting"; \
                exit 1; \
            fi; \
            # some modules require build dependencies
            if [ -f /modules/$module/build-deps ]; then \
                echo "Installing $module build dependencies"; \
                apk update && apk add $(cat /modules/$module/build-deps | xargs); \
            fi; \
            # if a module has a build dependency that is not in a distro, provide a
            # shell script to fetch/build/install those
            # note that shared libraries produced as a result of this script will
            # not be copied from the builder image to the main one so build static
            if [ -x /modules/$module/prebuild ]; then \
                echo "Running prebuild script for $module"; \
                /modules/$module/prebuild; \
            fi; \
            /opt/pkg-oss/build_module.sh -v $NGINX_VERSION -f -y -o /tmp/packages -n $module $(cat /modules/$module/source); \
        elif make -C /opt/pkg-oss/alpine list | grep -E "^$module\s+\d+" > /dev/null; then \
            echo "Building $module from pkg-oss sources"; \
            cd /opt/pkg-oss/alpine; \
            make abuild-module-$module BASE_VERSION=$NGINX_VERSION NGINX_VERSION=$NGINX_VERSION; \
            apk add $(. ./abuild-module-$module/APKBUILD; echo $makedepends;); \
            make module-$module BASE_VERSION=$NGINX_VERSION NGINX_VERSION=$NGINX_VERSION; \
            find ~/packages -type f -name "*.apk" -exec mv -v {} /tmp/packages/ \;; \
        else \
            echo "Don't know how to build $module module, exiting"; \
            exit 1; \
        fi; \
    done \
    && echo "Installing ModSecurity library" \
    && git clone --depth 1 -b v3/master --single-branch https://github.com/SpiderLabs/ModSecurity /opt/ModSecurity \
    && cd /opt/ModSecurity \
    && git submodule init \
    && git submodule update \
    && ./build.sh \
    && ./configure \
    && make \
    && make install \
    && echo "Adding OWASP rules in ModSecurity" \
    && git clone --depth 1 -b v3.3/master --single-branch https://github.com/coreruleset/coreruleset /opt/coreruleset \
    && mv /opt/coreruleset/crs-setup.conf.example /usr/local/modsecurity/crs-setup.conf \
    && mv /opt/coreruleset/rules /usr/local/modsecurity/rules \
    && echo "Cleaning" \
    && apk del build-deps \
    && rm -rf /opt/*

FROM nginx:mainline-alpine

ARG ENABLED_MODULES

COPY --from=builder /usr/local/modsecurity /usr/local/modsecurity

COPY --from=builder /tmp/packages /tmp/packages

RUN set -ex \
    && for module in $ENABLED_MODULES; do \
        apk add --no-cache --allow-untrusted /tmp/packages/nginx-module-${module}-${NGINX_VERSION}*.apk; \
    done \
    # the default rules return a 403 response code, they are changed to 444
    && sed -i 's/phase:1,log,auditlog,pass/phase:1,log,auditlog,pass,status:444/' /usr/local/modsecurity/crs-setup.conf \
    && sed -i 's/phase:2,log,auditlog,pass/phase:2,log,auditlog,pass,status:444/' /usr/local/modsecurity/crs-setup.conf \
    # enable ModSecurity
    && sed -i 's/SecRuleEngine DetectionOnly/SecRuleEngine On/' /etc/nginx/modsec/modsecurity.conf \
    # generate main file that include the default rules and OWASP rules
    && printf '%s\n' 'Include "/etc/nginx/modsec/modsecurity.conf"' \
        'Include "/usr/local/modsecurity/crs-setup.conf"' \
        'Include "/usr/local/modsecurity/rules/*.conf"' > /etc/nginx/modsec/main.conf \
    && rm -rf /tmp/packages /usr/share/nginx

COPY certbot.sh /opt

HEALTHCHECK --interval=1m30s --timeout=10s --start-period=30s --retries=3 \
    CMD if [ -e /var/run/nginx.pid ]; then echo "Nginx is running"; else echo "Nginx isn't running" && exit 1; fi

EXPOSE 80 443